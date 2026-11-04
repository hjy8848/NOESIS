import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Deck } from './repository';

export function DeckCover({deck,onOpen,animations}: {deck:Deck; onOpen:()=>void; animations:boolean}) {
  const progress=useSharedValue(0);
  const left=useAnimatedStyle(()=>({transform:[{translateX:-25*progress.value},{rotate:`${-8-8*progress.value}deg`}]}));
  const right=useAnimatedStyle(()=>({transform:[{translateX:25*progress.value},{rotate:`${6+8*progress.value}deg`}]}));
  function press() {
    if (!animations) {onOpen();return;}
    progress.value=withTiming(1,{duration:220},finished=>{if(finished){runOnJS(onOpen)();progress.value=0;}});
  }
  return <Pressable onPress={press} accessibilityRole="button" accessibilityLabel={`打开 ${deck.name} 牌组`} style={styles.container}>
    <View style={styles.stack}>
      <Animated.View style={[styles.backCard,left,{borderColor:deck.color}]}/>
      <Animated.View style={[styles.backCard,right,{borderColor:deck.color}]}/>
      <View style={[styles.frontCard,{borderColor:deck.color}]}><Text style={[styles.suit,{color:deck.color}]}>✦</Text></View>
    </View>
    <View style={styles.description}><Text style={styles.name}>{deck.name}</Text><Text numberOfLines={2} style={styles.subtitle}>{deck.description || '一组相互连接的思想'}</Text><Text style={styles.count}>{deck.cardCount ?? 0} 张卡片</Text></View>
  </Pressable>;
}
const styles=StyleSheet.create({
  container:{flexDirection:'row',alignItems:'center',backgroundColor:'#e8e2d4',borderRadius:16,padding:16,marginVertical:9,minHeight:138},
  stack:{width:90,height:108,marginHorizontal:14},
  backCard:{position:'absolute',top:4,left:8,width:74,height:98,borderWidth:2,borderRadius:10,backgroundColor:'#d9d0bd'},
  frontCard:{position:'absolute',top:4,left:8,width:74,height:98,borderWidth:2,borderRadius:10,backgroundColor:'#f5f0e5',alignItems:'center',justifyContent:'center'},
  suit:{fontSize:35},description:{flex:1},name:{fontSize:21,fontWeight:'600',color:'#344039'},subtitle:{fontSize:13,color:'#647066',marginTop:6,lineHeight:19},count:{fontSize:12,color:'#8a7961',marginTop:9},
});
