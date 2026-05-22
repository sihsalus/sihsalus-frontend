module.exports = process.env.VITEST
  ? {
      plugins: [],
    }
  : {
      plugins: [
        require('autoprefixer'),
        require('cssnano')({
          preset: 'default',
        }),
      ],
    };
