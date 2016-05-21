precision highp float;
precision highp sampler2D;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

// Textures
uniform sampler2D image;

// delta is the distance between samples expressed from 0.0 to 1.0
uniform float delta;


void main(void) {

  // subtract
  float dx, dy;

  dx = 0.0;
  dy = 0.0;

  // Can use Sobel, Prewit 
  
  dx += -1.0 * texture2D(image, vTexCoord + vec2(-delta,-delta)).x;
  dx += -1.0 * texture2D(image, vTexCoord + vec2(-delta,0)).x;
  dx += -1.0 * texture2D(image, vTexCoord + vec2(-delta,delta)).x;
  dx += texture2D(image, vTexCoord + vec2(delta,-delta)).x;
  dx += texture2D(image, vTexCoord + vec2(delta,0)).x;
  dx += texture2D(image, vTexCoord + vec2(delta,delta)).x;

  dy += -1.0 * texture2D(image, vTexCoord + vec2(-delta,-delta)).x;
  dy += -1.0 * texture2D(image, vTexCoord + vec2(0,-delta)).x;
  dy += -1.0 * texture2D(image, vTexCoord + vec2(delta,-delta)).x;
  dy += texture2D(image, vTexCoord + vec2(-delta,delta)).x;
  dy += texture2D(image, vTexCoord + vec2(0,delta)).x;
  dy += texture2D(image, vTexCoord + vec2(delta,delta)).x;

  gl_FragColor = vec4(dx, dy, 0.0, 1.0);
}
