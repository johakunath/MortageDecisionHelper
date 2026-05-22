export default {
  base: "./",
  resolve: {
    preserveSymlinks: true,
  },
  build: {
    minify: false,
  },
  test: {
    pool: "threads",
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
  },
};
