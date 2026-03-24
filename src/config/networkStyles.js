const networkStyles = {
  BRT: {
    color: '#008F4C',
    weight: 5,
  },
  TER: {
    color: '#6B4F2A',
    weight: 4,
  },
  DDD: {
    color: '#005F73',
    weight: 3,
  },
  AFTU: {
    color: '#E07A5F',
    weight: 3,
  },
};

const defaultStyle = {
  color: '#666666',
  weight: 2,
};

function getNetworkStyle(networkCode) {
  const code = (networkCode || '').toUpperCase();
  return networkStyles[code] || defaultStyle;
}

module.exports = { networkStyles, defaultStyle, getNetworkStyle };
