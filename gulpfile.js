var gulp        = require('gulp');
var browserSync = require('browser-sync').create();
var concat      = require('gulp-concat');
var sourcemaps  = require('gulp-sourcemaps');
var argv        = require('yargs').argv;
var exec        = require('child_process').exec;
var log         = require('gulp-util').log;
var dist = "./dist/"


// Build, returning a stream
gulp.task('js', function() {
  gulp.src('assets/vendor/*.js')
    .pipe(sourcemaps.init())
    .pipe(concat('vendor.js'))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest( dist+ "/js"));
  return gulp.src('assets/js/*.js')
    .pipe(sourcemaps.init())
    .pipe(concat('register.js'))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest( dist+ "/js"));
});

gulp.task('assets', function() {
  gulp.src('assets/images/**')
    .pipe(gulp.dest( dist+ "/images/"));
  gulp.src('assets/shaders/**')
    .pipe(gulp.dest( dist+ "/shaders/"));
  return gulp.src('assets/pages/*.html')
    .pipe(gulp.dest( dist+ "/"));
});

gulp.task('build', ['js', 'assets']);
gulp.task('watch', ['js', 'assets'], browserSync.reload);

// Static server
gulp.task('default', ['build'], function() {
  browserSync.init({
    open: argv.open,
    server: {
      baseDir: dist,
    }
  });

  // Rebuild when our assets change
  gulp.watch(["assets/**"], ['watch'], browserSync.reload);
});

gulp.task('book', function(cb) {
  exec('gitbook build', function(err,stdout,stderr) {
    log(stdout);
    if ( stderr ) {
      log(stderr);
    }
    gulp.src('_book/**').pipe(gulp.dest(dist + "doc"));
    cb(err);
  });
})
