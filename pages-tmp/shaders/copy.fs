precision highp float;
precision highp sampler2D;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

// Textures
uniform sampler2D image;

void main(void) {

  // Copy
  gl_FragColor = texture2D(image, vTexCoord);
  // if ( vTexCoord.x > 0.5 ) {
  //   gl_FragColor = vec4(0.0,0.0,0.0,1.0);
  // } else {
  //   gl_FragColor = vec4(1.0,1.0,1.0,1.0);
  // }
  
}
