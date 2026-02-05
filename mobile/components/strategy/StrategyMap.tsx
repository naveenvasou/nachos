import React from 'react';
import { StyleSheet, View, Text, ScrollView, Dimensions } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import GoalNode from './GoalNode';

const { width } = Dimensions.get('window');

// Mock Data for Visualization
const GOALS = [
    { id: '1', title: 'Launch MVP', subtitle: 'Q1 Objective', level: 'objective', x: width / 2 - 90, y: 50 },
    { id: '2', title: 'Complete Frontend', subtitle: 'React Native', level: 'key-result', x: width / 2 - 200, y: 200 },
    { id: '3', title: 'Backend API', subtitle: 'FastAPI + AI', level: 'key-result', x: width / 2 + 20, y: 200 },
    { id: '4', title: 'User Testing', subtitle: '5 Beta Users', level: 'task', x: width / 2 - 200, y: 350 },
];

const CONNECTIONS = [
    { from: '1', to: '2' },
    { from: '1', to: '3' },
    { from: '2', to: '4' },
];

export default function StrategyMap() {
    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            horizontal
            showsHorizontalScrollIndicator={false}
        >
            <ScrollView
                contentContainerStyle={{ width: width * 1.5, height: 800 }}
                showsVerticalScrollIndicator={false}
            >
                {/* SVG Layer for Lines */}
                <Svg height="100%" width="100%" style={styles.svgLayer}>
                    {CONNECTIONS.map((conn, index) => {
                        const start = GOALS.find(g => g.id === conn.from);
                        const end = GOALS.find(g => g.id === conn.to);
                        if (!start || !end) return null;

                        // Calculate centers
                        const x1 = start.x + 90; // width/2
                        const y1 = start.y + 80; // height/2 roughly (bottom)
                        const x2 = end.x + 90;
                        const y2 = end.y; // top

                        return (
                            <Line
                                key={index}
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke="#E5E7EB"
                                strokeWidth="2"
                                strokeDasharray="5, 5"
                            />
                        );
                    })}
                </Svg>

                {/* Nodes Layer */}
                {GOALS.map(goal => (
                    <GoalNode
                        key={goal.id}
                        title={goal.title}
                        subtitle={goal.subtitle}
                        level={goal.level as any}
                        x={goal.x}
                        y={goal.y}
                    />
                ))}
            </ScrollView>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    contentContainer: {
        flexGrow: 1,
    },
    svgLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 0,
    }
});
