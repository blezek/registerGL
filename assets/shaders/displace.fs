precision highp float;
precision highp sampler2D;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

// Textures
uniform sampler2D r;
uniform sampler2D movingImage;

void main(void) {

  vec4 rVal = texture2D(r, vTexCoord);
  vec4 moving = texture2D(movingImage, vTexCoord + rVal.xy);
  gl_FragColor = moving;
}
