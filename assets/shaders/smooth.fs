precision highp float;
precision highp sampler2D;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

// Textures
uniform sampler2D image;
uniform float sigma;
uniform float delta;

// x == 0, y == 1
uniform float direction;

#define PI 3.14159265359

void main(void) {
  // calculate gradient in a 5x5 window
  float scale, escale;

  scale = 1.0 / (sigma * sqrt ( 2.0 * PI ) );
  escale = -1.0 / ( 2.0 * sigma * sigma );

  vec2 d = vec2 ( delta, 0.0 );
  if (direction == 1.0) {
      d = vec2 ( 0.0, delta );
  }

  vec4 sum = vec4(0.0,0.0,0.0,0.0);
  // for (int x = -2; x <= 2; x++) {
  for (int x = -20; x <= 20; x++) {
    float fx = float(x);
    float x2 = fx * fx;
    vec4 color = texture2D(image, vTexCoord + fx * d );
    sum += exp ( x2 * escale ) * color;
  }
  sum = scale * sum;

  // leave b and alpha alone
  vec4 s = texture2D(image, vTexCoord);
  sum.ba = s.ba;
  gl_FragColor = sum;
}
