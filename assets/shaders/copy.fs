precision highp float;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

// Textures
uniform sampler2D image;

void main(void) {

  // Copy
  gl_FragColor = texture2D(image, vTexCoord);
  
}
