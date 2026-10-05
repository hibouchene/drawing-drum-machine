import { defineConfig } from 'vite';
import { localLib } from '../vite.local';

export default defineConfig(({ mode }) => ({
  root: "./base",
  ...localLib(mode)
}));
