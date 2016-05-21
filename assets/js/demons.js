/*
  demonsStep -- calculate one step in the demon's algorthim, i.e. update `r`
  Parameters:
    r -- registration object
    count -- number of steps
  1. transform the movingImage using the `displace` kernel
  2. calculate the movingImage gradient
  3. smooth the movingImage gradient
  4. calculate `dr`, the delta in `r`
  5. smooth `dr`
  6. update `r`
  7. smooth `r`
 */

function demonsStep(r,count) {
  count = count || 1;
  console.log("Running " + count + " steps in the Demon's algorithm");

  // delta between pixels, i.e. 1 / image size
  var delta = 1./512.;
  
  // Sigmas are in pixels
  var imageSigma = 0.0;
  var gradientSigma = 0.0;
  var drSigma = 10.0;
  var rSigma = 1.0;

  // How fast to update
  var scale = 0.2;
  
  var gl = r.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
  gl.viewport(0,0,512,512);
  
  for ( var counter = 0; counter < count; counter++ ) {
    // Update moving image
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["displaced"], 0);
    render ( r, r.programs["displace"], [
      {name: "movingImage", value: r.movingTexture},
      {name: "r", value: r.textures["r"]},
      {name: "scale", value: scale},
    ]);

    // Smooth the displaced image
    smoothBuffer ( r, "displaced", imageSigma, delta );
    
    // Calculate the gradients
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["B"], 0);
    render ( r, r.programs["copy"], [
      {name: "image", value: r.textures["fixed"]},
    ]);
    
    smoothBuffer ( r, "A", imageSigma, delta );
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["fixedGradient"], 0);
    render ( r, r.programs["gradient"], [
      {name: "image", value: r.textures["B"]},
      {name: "delta", value: delta},
    ]);
    // Smooth the gradient
    smoothBuffer ( r, "fixedGradient", gradientSigma, delta );
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["movingGradient"], 0);
    render ( r, r.programs["gradient"], [
      {name: "image", value: r.textures['displaced']},
      {name: "delta", value: delta},
    ]);
    // Smooth the gradient
    smoothBuffer ( r, "movingGradient", gradientSigma, delta );

    // 4. calculate `dr`, the delta in `r`
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["dr"], 0);
    render ( r, r.programs["displacement"], [
      {name: "fixedImage", value: r.textures["fixed"]},
      {name: "fixedImageGradient", value: r.textures["fixedGradient"]},
      {name: "movingImage", value: r.textures["displaced"]},
      {name: "movingImageGradient", value: r.textures["movingGradient"]},
      {name: "spacing", value: 1.0},
    ]);

    // 5. smooth `dr`
    smoothBuffer ( r, "dr", drSigma, delta );
    
    // 6. update `r`
    // Calculate to "A", copy to "r"
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["A"], 0);
    render ( r, r.programs["updateR"], [
      {name: "r", value: r.textures["r"]},
      {name: "dr", value: r.textures["dr"]},
    ]);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["r"], 0);
    render ( r, r.programs["copy"], [
      {name: "image", value: r.textures["A"]},
    ]);
    
    // 7. smooth `r`
    smoothBuffer ( r, "r", rSigma, delta );
    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["difference"], 0);
    render ( r, r.programs["difference"], [
      {name: "movingImage", value: r.textures["displaced"]},
      {name: "fixedImage", value: r.textures["fixed"]},
    ]);


    smoothBuffer(r,"B", 10, delta);
    
  }  
}

function smoothBuffer ( r, buffer, sigma, delta ) {
  if ( sigma == 0.0 ) { return; }
  // First do horizontal pass from buffer into "B"
  // Second do vertical pass from "B" into buffer
  var gl = r.gl;
  var tmpBuffer = "A";
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures[tmpBuffer], 0);
  render ( r, r.programs["smooth"], [
    {name: "image", value: r.textures[buffer]},
    {name: "delta", value: delta},
    {name: "sigma", value: sigma},
    {name: "direction", value: 0},
  ]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures[buffer], 0);
  render ( r, r.programs["smooth"], [
    {name: "image", value: r.textures[tmpBuffer]},
    {name: "delta", value: delta},
    {name: "sigma", value: sigma},
    {name: "direction", value: 1},
  ]);
}
