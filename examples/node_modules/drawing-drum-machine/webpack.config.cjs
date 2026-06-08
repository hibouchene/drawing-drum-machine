const path = require('path');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    entry: './src/index.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProd ? 'drawing-drum-machine.min.js' : 'drawing-drum-machine.js',
      library: {
        type: 'module',
      },
      module: true,
      clean: true,
    },
    experiments: {
      outputModule: true,
    },
    target: 'web',
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            },
          },
          exclude: /node_modules/,
        },
      ],
    },
    devtool: isProd ? 'source-map' : 'eval-source-map',
  };
};
