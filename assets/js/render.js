// Render using WebGL
// args:
//   r          -- register object
//   program    -- which program to use in the rendering
//   parameters -- array of values to pass to the program, consists of name / value pairs, e.g. { name: "time", value: 123.3 }
//                 may be int, float, bool, texture

function isInteger(n){
    return n === +n && n === (n|0);
}

function isFloat(n){
    return n === +n && n !== (n|0);
}

function isBoolean(n){
  return typeof(n) === "boolean";
}

function isImage(n){
  return n instanceof WebGLTexture;
}

function render ( r, program, parameters ) {

  var gl = r.gl;
  gl.useProgram(program);
  checkGLError(gl);
  // window.requestAnimationFrame(render,canvas);

  var tex = gl.getAttribLocation(r.metricProgram, 'texPosition');
  checkGLError(gl);
  gl.bindBuffer(gl.ARRAY_BUFFER, r.textureCoordBuffer);
  checkGLError(gl);
  gl.enableVertexAttribArray(tex);
  checkGLError(gl);
  gl.vertexAttribPointer(tex, 2, gl.FLOAT, false, 0, 0);
  checkGLError(gl);

  // Create a buffer and put a single clipspace rectangle in
  // it (2 triangles)
  var position = gl.getAttribLocation(r.displayProgram, 'position');
  gl.bindBuffer(gl.ARRAY_BUFFER, r.buffer);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  // Bind uniforms
  var textureIndex = 0;
  parameters.forEach( function(param, index) {
    var location = gl.getUniformLocation(program, param.name);
    if ( isImage(param.value) ) {
      var sampler = gl.getUniformLocation(program, param.name);
      gl.activeTexture(gl.TEXTURE0 + textureIndex);
      gl.bindTexture(gl.TEXTURE_2D, param.value);
      gl.uniform1i(sampler, textureIndex);
      checkGLError(gl);
      textureIndex++;
    } else if ( isBoolean(param.value) ) {
      gl.uniform1i(location, param.value);
    } else if ( isFloat(param.value) ) {
      gl.uniform1f(location, param.value);
    }
    
  });

  // draw
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  
}
