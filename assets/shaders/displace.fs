precision highp float;
precision highp sampler2D;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

// Textures
uniform sampler2D r;
uniform sampler2D movingImage;

uniform float scale;

void main(void) {

  vec4 delta = texture2D(r, vTexCoord);
  gl_FragColor = texture2D(movingImage, vTexCoord - delta.xy);
}
