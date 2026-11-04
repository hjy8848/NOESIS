import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, SharedValue, useAnimatedProps, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Marker, Path, Text as SvgText } from 'react-native-svg';
import { Thought } from './types';
import { Relation } from './repository';

type Point = {x:number; y:number};
type Positions = Record<string,Point>;
const colors:Record<string,string> = {supports:'#70a481',contradicts:'#c47b75',explains:'#8b9cc5',causes:'#d09b62',extends:'#ac8bc1',related:'#aa9874'};
const labels:Record<string,string> = {supports:'支持',contradicts:'反驳',explains:'解释',causes:'导致',extends:'扩展',related:'相关'};
const AnimatedLine=Animated.createAnimatedComponent(Line);
const AnimatedCircle=Animated.createAnimatedComponent(Circle);
const AnimatedText=Animated.createAnimatedComponent(SvgText);

function Edge({relation,positions,selected}: {relation:Relation; positions:SharedValue<Positions>; selected:string|null}) {
  const line=useAnimatedProps(()=>{
    const a=positions.value[relation.sourceThoughtId] || {x:0,y:0},b=positions.value[relation.targetThoughtId] || {x:0,y:0};
    const dx=b.x-a.x,dy=b.y-a.y,dist=Math.sqrt(dx*dx+dy*dy)||1;
    return {x1:a.x+dx/dist*29,y1:a.y+dy/dist*29,x2:b.x-dx/dist*31,y2:b.y-dy/dist*31};
  });
  const text=useAnimatedProps(()=>{const a=positions.value[relation.sourceThoughtId] || {x:0,y:0},b=positions.value[relation.targetThoughtId] || {x:0,y:0};return {x:(a.x+b.x)/2,y:(a.y+b.y)/2-5};});
  const active=!selected || relation.sourceThoughtId===selected || relation.targetThoughtId===selected;
  const color=colors[relation.relationType] || colors.related;
  return <><AnimatedLine animatedProps={line} stroke={color} opacity={active?1:.2} strokeWidth={active?2:1} markerEnd={`url(#arrow-${relation.relationType})`}/><AnimatedText animatedProps={text} textAnchor="middle" fill={color} opacity={active?1:.2} fontSize="10">{labels[relation.relationType] || relation.relationType}</AnimatedText></>;
}

function NodeVisual({thought,positions,selected,neighbor,light}: {thought:Thought;positions:SharedValue<Positions>;selected:string|null;neighbor:boolean;light:boolean}) {
  const circle=useAnimatedProps(()=>({cx:positions.value[thought.id]?.x ?? 0,cy:positions.value[thought.id]?.y ?? 0}));
  const text=useAnimatedProps(()=>({x:positions.value[thought.id]?.x ?? 0,y:(positions.value[thought.id]?.y ?? 0)+48}));
  return <><AnimatedCircle animatedProps={circle} r={28} fill={selected===thought.id?'#a88e62':neighbor?'#768d71':'#52645a'} opacity={!selected||neighbor||selected===thought.id?1:.5} stroke="#cdbb92"/><AnimatedText animatedProps={text} textAnchor="middle" fill={light?'#33453a':'#e8dec9'} fontSize="12">{thought.title.length>10?thought.title.slice(0,10)+'…':thought.title}</AnimatedText></>;
}

function NodeTouch({thought,positions,scale,width,height,select}: {thought:Thought;positions:SharedValue<Positions>;scale:number;width:number;height:number;select:(id:string)=>void}) {
  const origin=useSharedValue<Point>({x:0,y:0});
  const position=useAnimatedStyle(()=>{const p=positions.value[thought.id] || {x:0,y:0};return {left:(p.x-30)*scale,top:(p.y-30)*scale,width:60*scale,height:60*scale};});
  const pan=Gesture.Pan().minDistance(4).onStart(()=>{origin.value=positions.value[thought.id];}).onUpdate(event=>{const p=origin.value;positions.value={...positions.value,[thought.id]:{x:Math.max(30,Math.min(width-30,p.x+event.translationX/scale)),y:Math.max(30,Math.min(height-55,p.y+event.translationY/scale))}};});
  const tap=Gesture.Tap().maxDistance(8).onEnd((_event,success)=>{if(success)runOnJS(select)(thought.id);});
  return <GestureDetector gesture={Gesture.Race(pan,tap)}><Animated.View accessibilityLabel={`${thought.title} 图谱节点`} style={[styles.touch,position]}/></GestureDetector>;
}

export function Graph({thoughts,relations,open,light}: {thoughts:Thought[];relations:Relation[];open:(t:Thought)=>void;light:boolean}) {
  const [scale,setScale]=useState(1);const [selected,setSelected]=useState<string|null>(null);
  const width=Math.max(340,Math.ceil(Math.sqrt(thoughts.length))*160);
  const cols=Math.max(1,Math.floor(width/160));
  const height=Math.max(280,Math.ceil(thoughts.length/cols)*130);
  const initial=useMemo(()=>Object.fromEntries(thoughts.map((t,i)=>[t.id,{x:80+(i%cols)*160,y:65+Math.floor(i/cols)*130}])),[thoughts,cols]);
  const positions=useSharedValue<Positions>(initial);
  useEffect(()=>{const existing=positions.value;positions.value=Object.fromEntries(Object.entries(initial).map(([id,p])=>[id,existing[id] || p]));},[initial]);
  const pinchScale=useSharedValue(1);
  const pinchStyle=useAnimatedStyle(()=>({transform:[{scale:pinchScale.value}]}));
  function commitScale(factor:number) {setScale(value=>Math.max(.5,Math.min(2,value*factor)));}
  const pinch=Gesture.Pinch().onUpdate(event=>{pinchScale.value=Math.max(.5,Math.min(2,event.scale));}).onEnd(event=>{runOnJS(commitScale)(event.scale);pinchScale.value=1;}).onFinalize((_event,success)=>{if(!success)pinchScale.value=1;});
  const neighbors=new Set(relations.filter(r=>r.sourceThoughtId===selected||r.targetThoughtId===selected).flatMap(r=>[r.sourceThoughtId,r.targetThoughtId]));
  const ids=new Set(thoughts.map(t=>t.id));
  const chosen=thoughts.find(t=>t.id===selected);
  return <><View style={styles.row}><Pressable style={styles.button} onPress={()=>setScale(v=>Math.max(.5,v-.25))}><Text style={styles.buttonText}>缩小</Text></Pressable><Pressable style={styles.button} onPress={()=>setScale(v=>Math.min(2,v+.25))}><Text style={styles.buttonText}>放大</Text></Pressable><Pressable style={styles.button} onPress={()=>{positions.value=initial;}}><Text style={styles.buttonText}>重置布局</Text></Pressable></View>
    <GestureDetector gesture={pinch}><Animated.View style={pinchStyle}><ScrollView horizontal><View style={{width:width*scale,height:height*scale}}>
      <Svg width={width*scale} height={height*scale} viewBox={`0 0 ${width} ${height}`}><Defs>{Object.keys(colors).map(type=><Marker key={type} id={`arrow-${type}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><Path d="M0,0 L8,4 L0,8 z" fill={colors[type]}/></Marker>)}</Defs>
        {relations.filter(r=>ids.has(r.sourceThoughtId)&&ids.has(r.targetThoughtId)).map(r=><Edge key={r.id} relation={r} positions={positions} selected={selected}/>)}
        {thoughts.map(t=><NodeVisual key={t.id} thought={t} positions={positions} selected={selected} neighbor={neighbors.has(t.id)} light={light}/>)}
      </Svg>{thoughts.map(t=><NodeTouch key={t.id} thought={t} positions={positions} scale={scale} width={width} height={height} select={setSelected}/>)}</View></ScrollView></Animated.View></GestureDetector>
    {chosen && <View style={styles.panel}><Text style={styles.body}>{chosen.title} · {relations.filter(r=>r.sourceThoughtId===chosen.id||r.targetThoughtId===chosen.id).length} 个直接关联</Text><Pressable style={styles.button} onPress={()=>open(chosen)}><Text style={styles.buttonText}>查看卡片</Text></Pressable></View>}
  </>;
}
const styles=StyleSheet.create({row:{flexDirection:'row',gap:8,marginVertical:8},button:{backgroundColor:'#343c38',borderWidth:1,borderColor:'#556056',borderRadius:9,paddingVertical:10,paddingHorizontal:13,marginVertical:4},buttonText:{color:'#f5eee3',fontSize:14},panel:{backgroundColor:'#252b28',padding:18,borderRadius:14,marginVertical:8},body:{color:'#e8decf',fontSize:15,lineHeight:25,marginVertical:8},touch:{position:'absolute'}});
