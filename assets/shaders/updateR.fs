precision highp float;
precision highp sampler2D;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

// Textures
uniform sampler2D r;
uniform sampler2D dr;

void main(void) {

  vec4 rVal = texture2D(r, vTexCoord);
  vec4 drVal = texture2D(dr, vTexCoord);

  gl_FragColor = rVal + drVal;
  gl_FragColor.a = 1.0;
}
