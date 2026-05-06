import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface Tab {
  key: string;
  label: string;
  icon: string;
}

interface TabBarProps {
  active: string;
  onTab: (tab: string) => void;
  tabs: Tab[];
}

export function TabBar({ active, onTab, tabs }: TabBarProps) {
  return (
    <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border flex-row items-center pb-2.5" style={{ height: 70 }}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            className="flex-1 items-center justify-center py-1.5"
            onPress={() => onTab(tab.key)}
            activeOpacity={0.7}
          >
            {isActive && <View className="absolute top-1 w-1 h-1 rounded-full bg-primary" />}
            <Text className="text-2xl">{tab.icon}</Text>
            <Text className={`text-[10px] font-semibold mt-0.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

