import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const StatCard = ({ title, value, color }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 8,
    flex: 1,
    minWidth: '40%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  title: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
    fontWeight: '600',
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default StatCard;
