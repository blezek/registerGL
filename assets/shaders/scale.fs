precision highp float;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

// Textures
uniform sampler2D image;

uniform float scale;

void main(void) {

  // scale
  gl_FragColor = scale * texture2D(image, vTexCoord);
  
}
