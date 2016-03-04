// Compiles a WebGL program into the GL context and returns a promise.
// The program is passed to the resolve callback, and any error messages
// are returned as HTML text in the reject callback.
//
// args:
//  gl             -- WebGL context
//  vertexSource   -- URL of the shader source
//  fragmentSource -- URL of the fragment shader

function compile_program ( gl, vertexSource, fragmentSource ) {

  return new Promise(function(resolve,reject) {
    var message = "";
    var vertex_shader = "";
    var fragment_shader = "";
    
    // Create the program
    var glProgram = gl.createProgram();
    
    // Load our shaders
    fetch_file(vertexSource).then(function(text) {
      vertex_shader = text;
      return fetch_file(fragmentSource);
    }).then (function(text){
      fragment_shader = text;
      return Promise.resolve();
    }).then ( function() {
      
      var vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, vertex_shader);
      gl.compileShader(vertexShader);
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        message = message + "<h4>vertex</h3><pre>" + gl.getShaderInfoLog(vertexShader) + "</pre>";
      }
      
      var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, fragment_shader);
      gl.compileShader(fragmentShader);
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        message = message + "<h4>fragment</h3><pre>" + gl.getShaderInfoLog(fragmentShader) + "</pre>";
      }

      if ( message != "") {
        message = message.replace(/\0/g, "");
        message = message.replace(/\n/g, "<br>");
        reject(message);
      }

      try {
        gl.attachShader(glProgram, vertexShader);
        checkGLError(gl);
        gl.attachShader(glProgram, fragmentShader);
        checkGLError(gl);
        gl.linkProgram(glProgram);
        checkGLError(gl);
      } catch ( message ) {
        reject(message);
      }
      resolve(glProgram)
      
    });
  });
}
