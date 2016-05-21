precision highp float;
precision highp sampler2D;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

// Textures
uniform sampler2D fixedImage;
uniform sampler2D fixedImageGradient;
uniform sampler2D movingImage;
uniform sampler2D movingImageGradient;

// Spacing between pixels.  Give intensity differences and gradients the same
// units.
uniform float spacing;

void main(void) {

  // normalization factor alpha
  float alpha = 0.04;

  float Im, If;
  vec4 dIm, dIf;

  Im = texture2D(movingImage, vTexCoord).x;
  dIm = texture2D(movingImageGradient, vTexCoord);

  If = texture2D(fixedImage, vTexCoord).x;
  dIf = texture2D(fixedImageGradient, vTexCoord);


  // Implement equation (4) from "Implementation and evaluation of various demons deformable image registration algorithms on GPU" by Gu, et. al.
  float intensityDelta = (Im - If);

  if ( abs(intensityDelta) < 0.1 ) {
    intensityDelta = 0.0;
  }
  
  float intensityDelta2 = intensityDelta * intensityDelta;
  float spacing2 = spacing * spacing;
  
  float length_of_dIf = length(dIf);
  float length_of_dIm = length(dIm);

  // Passive force (1)
  vec4 passiveForce = intensityDelta * dIf / ( alpha * intensityDelta2 + length_of_dIf * length_of_dIf );

  // Active force (3)
  vec4 activeForce = intensityDelta * dIm / ( alpha * intensityDelta2 + length_of_dIm * length_of_dIm );

  vec4 dr = activeForce + passiveForce;
  dr = activeForce + passiveForce;

  dr = 1.0 / 512. * dr;
  dr.a = 1.0;
  gl_FragColor = dr;

//   if ( intensityDelta != 0.0 ) {
//     gl_FragColor = vec4(Im,0.0,0.0,1.0);
//   } else {
//     gl_FragColor = vec4(0.0,0.0,0.0,1.0);
//   }
}
