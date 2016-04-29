precision highp float;
precision highp sampler2D;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

// Textures
uniform sampler2D fixedImage;
uniform sampler2D fixedImageGradient;
uniform sampler2D movingImage;
uniform sampler2D movingImageGradient;

void main(void) {

  float Im, If;
  vec4 dIm, dIf;

  Im = texture2D(movingImage, vTexCoord).x;
  dIm = texture2D(movingImageGradient, vTexCoord);

  If = texture2D(fixedImage, vTexCoord).x;
  dIf = texture2D(fixedImageGradient, vTexCoord);

  float delta = Im - If;
  // vec4 s = dIm + dIf;
  float l = dIf.z;
  vec4 dr = delta * dIf / ( delta * delta + l );
  // dr.x = dIf.x / l;
  // dr.y = 0.0;
  // dr.r = delta;
  // dr.g = 0.0;
  dr.b = 0.0;
  dr.a = 1.0;
  gl_FragColor = dr;
}
