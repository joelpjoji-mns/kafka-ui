import 'whatwg-fetch';
import 'jest-styled-components';
import '@testing-library/jest-dom/jest-globals';
import { TextDecoder, TextEncoder } from 'util';

global.TextEncoder = TextEncoder as typeof global.TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;
