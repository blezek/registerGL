// Sum the pixels in the input image to the output image
// Parameters are:
// image    -- sampler for the input image
// count    -- number of pixels to sum in X and Y
// offset   -- offset in the input texture space, usually 1.0 / input_texture_width


// An important consideration here.  When rendering to a texture, there is an interplay
// with gl.viewport and gl.bindFramebuffer/gl.framebufferTexture2D.  If the viewport
// is bigger than the texture, the texture will only contain part of the viewport, and
// the remainder will be drawn "outside" the texture.  To have the texture cover the
// entire viewport, the texture and viewport need to be the same.  For downsampling, this
// usually means the viewport must be set to the same size as the texture.
//
// var dim = 256;
// var texture = create_float_texture ( register, dim, dim );
// var framebuffer = gl.createFramebuffer();
// gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
// gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
// gl.viewport(0,0,dim,dim);


precision highp float;
precision highp sampler2D;

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
    if ( float(x) >= count ) {
      break;
    }
    for ( int y = 0; y < LOOP_MAX; y+=1 ) {
      if ( float(y) >= count ) {
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

  // accumulator = texture2D ( image, vTexCoord);
  // accumulator = vec4( 1.0 * vTexCoord.x, 0, 0, 1);
  gl_FragColor = accumulator;
  
}
