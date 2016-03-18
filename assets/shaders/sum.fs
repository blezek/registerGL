// Sum the pixels in the input image to the output image
// Parameters are:
// image    -- sampler for the input image
// count    -- number of pixels to sum in X and Y
// offset   -- offset in the input texture space, usually 1.0 / input_texture_width

precision highp float;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

// Textures
uniform sampler2D image;

uniform float count;
uniform float offset;

#define LOOP_MAX 4

void main(void) {

  // Copy
  highp vec4 accumulator;

  for ( int x = 0; x < LOOP_MAX; x+=1 ) {
    if ( float(x) > count ) {
      break;
    }
    for ( int y = 0; y < LOOP_MAX; y+=1 ) {
      if ( float(y) > count ) {
        break;
      }
      accumulator += texture2D ( image, vTexCoord + vec2(float(x)*offset, float(y)*offset));
    }
  }
  // for ( float x = 0.0; x < count; x+=1.0 ) {
  //   for ( float y = 0.0; y < count; y+=1.0 ) {
  //     accumulator += texture2D ( image, vTexCoord + vec2(x*offset, y*offset));
  //   }
  // }

  
  gl_FragColor = accumulator;
  
}
