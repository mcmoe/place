const gulp = require("gulp");
const replace = require('gulp-replace');
const uglify = require("gulp-terser");
const sourcemaps = require('gulp-sourcemaps');
const changed = require('gulp-changed');
const del = require("del");
const config = require('../config/config');
class JavaScriptProcessor {
    constructor(app) {
        this.app = app;
        
        this.paths = {
            scripts: {
                built: "public/js/build",
                src: "client/js/*.js"
            }
        };

        var swallowError = function(error) {
            app.reportError("Error while processing JavaScript: " + error);
            this.emit("end");
        }

        // Clean existing built JavaScript
        gulp.task("clean", () => del([this.paths.scripts.built]));
        // Rerun the task when a file changes 
        gulp.task("watch", () => gulp.watch(this.paths.scripts.src, ["scripts"]));
        // Process JavaScript
        gulp.task("scripts", (cb) => {
            this.app.logger.info('JsProc', "Processing JavaScript…");
            var t = gulp.src(this.paths.scripts.src);
            t = t.pipe(replace('$(WSURI)', process.env.WSURI || config.wsUri));
            t = t.pipe(changed(this.paths.scripts.built));
            t = t.pipe(sourcemaps.init());
            if(!this.app.config.debug) t = t.pipe(uglify());
            t = t.on("error", swallowError);
            t = t.pipe(sourcemaps.write('.'));
            t = t.pipe(gulp.dest(this.paths.scripts.built));
            t = t.on("end", () => this.app.logger.info('JsProc', "Finished processing JavaScript."));
            return t;
        });
        this.watchJavaScript()
        gulp.task("default", ["watch", "scripts"]);
    }

    processJavaScript() {
        gulp.start(["scripts"]);
    }

    cleanJavaScript() {
        gulp.start(["clean"]);
    }

    watchJavaScript() {
        gulp.start(["watch"]);
    }
}

JavaScriptProcessor.prototype = Object.create(JavaScriptProcessor.prototype);

module.exports = JavaScriptProcessor;