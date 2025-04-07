// Mock for react-router-dom
import React from 'react';

const mockNavigate = jest.fn();
const mockParams = { id: '100' };

module.exports = {
  useParams: () => mockParams,
  useNavigate: () => mockNavigate,
  Link: ({ children, ...props }) => React.createElement('a', props, children),
  mockNavigate,
  mockParams
};