precision highp float;
precision highp sampler2D;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

// Textures
uniform sampler2D image;

uniform float scale;

void main(void) {

  // scale
  gl_FragColor = scale * texture2D(image, vTexCoord);
}
