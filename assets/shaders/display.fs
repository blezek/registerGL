precision highp float;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

uniform sampler2D image;

void main(void) {
  // Simply display the image
  gl_FragColor = texture2D(image, vTexCoord);
}
