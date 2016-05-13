precision highp float;
precision highp sampler2D;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

uniform sampler2D image;

void main(void) {
  // Simply display the image
  // Red is positve, blue is negative
  
  gl_FragColor = abs(texture2D(image, vTexCoord));
}
