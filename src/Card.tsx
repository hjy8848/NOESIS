import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Thought } from './types';

const labels = {proposition:'命题',concept:'概念',source:'来源'};
const symbols = {proposition:'♠',concept:'♦',source:'♣'};
const colors = {proposition:'#516354',concept:'#8d6a5c',source:'#6b728b'};

type Props = { thought:Thought; onOpen:()=>void; onNext:()=>void; onPrevious:()=>void; canNext:boolean; canPrevious:boolean; animations:boolean; favorite:boolean; relationCount:number; deckNames:string[]; };

export function Card({thought,onOpen,onNext,onPrevious,canNext,canPrevious,animations,favorite,relationCount,deckNames}:Props) {
  const flip=useSharedValue(0);
  const flipTarget=useSharedValue(0);
  const x=useSharedValue(0);
  const spring={damping:19,stiffness:180};
  const pan=Gesture.Pan().activeOffsetX([-14,14]).failOffsetY([-18,18])
    .onUpdate(event=>{ x.value=event.translationX; })
    .onEnd(event=>{
      const direction=(Math.abs(event.translationX)>10 ? event.translationX : event.velocityX) < 0 ? -1 : 1;
      if (Math.abs(event.translationX)>90 || Math.abs(event.velocityX)>700) {
        if ((direction<0 && !canNext) || (direction>0 && !canPrevious)) { x.value=animations ? withSpring(0,spring) : 0; return; }
        if (animations) x.value=withTiming(direction*500,{duration:180},finished=>{if(finished) {if(direction<0) runOnJS(onNext)(); else runOnJS(onPrevious)();}});
        else { if(direction<0) runOnJS(onNext)(); else runOnJS(onPrevious)(); }
      } else x.value=animations ? withSpring(0,spring) : 0;
    }).onFinalize((_event,success)=>{if(!success) x.value=animations ? withSpring(0,spring) : 0;});
  const tap=Gesture.Tap().maxDistance(12).onEnd((_event,success)=>{if(success){flipTarget.value=flipTarget.value===0 ? 1 : 0;flip.value=animations ? withSpring(flipTarget.value,spring) : flipTarget.value;}});
  const longPress=Gesture.LongPress().minDuration(450).maxDistance(12).onEnd((_event,success)=>{if(success)runOnJS(onOpen)();});
  const motion=useAnimatedStyle(()=>({transform:[{translateX:x.value},{rotateZ:`${interpolate(x.value,[-300,0,300],[-9,0,9])}deg`}]}));
  const front=useAnimatedStyle(()=>({transform:[{perspective:1000},{rotateY:`${flip.value*180}deg`}]}));
  const back=useAnimatedStyle(()=>({transform:[{perspective:1000},{rotateY:`${180+flip.value*180}deg`}]}));
  const accent=colors[thought.type] || colors.proposition;
  return <GestureDetector gesture={Gesture.Race(pan,longPress,tap)}>
    <Animated.View style={[styles.wrapper,motion]} accessibilityLabel={`${thought.title}，点击翻面，长按查看详情`}>
      <View style={styles.stackOne}/><View style={styles.stackTwo}/>
      <Animated.View style={[styles.card,styles.face,{borderColor:accent},front]}>
        <View style={styles.cornerRow}><Text style={[styles.corner,{color:accent}]}>{symbols[thought.type]}  {labels[thought.type]}  /  {thought.id.slice(0,4).toUpperCase()}</Text><Text style={[styles.corner,{color:accent}]}>{favorite?'★':'☆'}</Text></View>
        <Text style={[styles.symbol,{color:accent}]}>{symbols[thought.type]}</Text>
        <Text numberOfLines={3} style={styles.title}>{thought.title}</Text>
        <Text style={styles.foot}>NOESIS  ·  点击翻面</Text>
      </Animated.View>
      <Animated.View style={[styles.card,styles.face,styles.back,{borderColor:accent},back]}>
        <Text style={[styles.corner,{color:accent}]}>{labels[thought.type]}  /  {thought.id.slice(0,4).toUpperCase()}</Text>
        <Text numberOfLines={3} style={styles.title}>{thought.title}</Text>
        <Text numberOfLines={6} style={styles.summary}>{thought.summary || '尚未填写摘要'}</Text>
        <Text numberOfLines={2} style={styles.foot}>{deckNames.length ? deckNames.join(' · ') : '未归入牌组'}  /  {relationCount} 个关联</Text>
      </Animated.View>
    </Animated.View>
  </GestureDetector>;
}

const styles=StyleSheet.create({
  wrapper:{width:'100%',aspectRatio:5/7,maxHeight:500,alignSelf:'center',marginVertical:20},
  stackOne:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'#c0b69e',borderRadius:22,transform:[{rotate:'-3deg'},{translateY:5}]},
  stackTwo:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'#d4cbb7',borderRadius:22,transform:[{rotate:'2deg'},{translateY:3}]},
  card:{position:'absolute',top:0,right:0,bottom:0,left:0,borderRadius:22,padding:24,backgroundColor:'#eee6d5',borderWidth:4,justifyContent:'space-between',shadowColor:'#000',shadowOpacity:.3,shadowRadius:12,shadowOffset:{width:0,height:8},elevation:8},
  face:{backfaceVisibility:'hidden'},back:{backgroundColor:'#e4dac5'},cornerRow:{flexDirection:'row',justifyContent:'space-between'},corner:{fontSize:12,letterSpacing:2},symbol:{textAlign:'center',fontSize:74},title:{fontSize:25,fontWeight:'600',color:'#344039',textAlign:'center'},summary:{fontSize:16,color:'#4e584f',lineHeight:26,textAlign:'center'},foot:{textAlign:'center',color:'#80715a',fontSize:11,letterSpacing:1},
});
