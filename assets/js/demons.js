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
  for ( var counter = 0; counter < count; counter++ ) {
    var gl = r.gl;
    // Update moving image
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["displaced"], 0);
    render ( r, r.programs["displace"], [
      {name: "movingImage", value: r.movingTexture},
      {name: "r", value: r.textures["r"]},
    ]);

    // Smooth the displaced image
    // smoothBuffer ( r, "displaced", 4.0 );
    
    // Calculate the gradients
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["A"], 0);
    render ( r, r.programs["copy"], [
      {name: "image", value: r.textures["fixed"]},
    ]);
    // smoothBuffer ( r, "A", 4.0 );
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["fixedGradient"], 0);
    render ( r, r.programs["gradient"], [
      {name: "image", value: r.textures["A"]},
      {name: "delta", value: 1/512},
    ]);
    // Smooth the gradient
    // smoothBuffer ( r, "fixedGradient", 4.0 );
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["movingGradient"], 0);
    render ( r, r.programs["gradient"], [
      {name: "image", value: r.textures['displaced']},
      {name: "delta", value: 1/512},
    ]);
    // Smooth the gradient
    // smoothBuffer ( r, "movingGradient", 4.0 );

    // 4. calculate `dr`, the delta in `r`
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["dr"], 0);
    render ( r, r.programs["displacement"], [
      {name: "fixedImage", value: r.textures["fixed"]},
      {name: "fixedImageGradient", value: r.textures["fixedGradient"]},
      {name: "movingImage", value: r.textures["displaced"]},
      {name: "movingImageGradient", value: r.textures["movingGradient"]},
    ]);

    // 5. smooth `dr`
    // smoothBuffer ( r, "dr", 2.0 );
    
    // 6. update `r`
    // Calculate to "A", copy to "r"
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["r"], 0);
    render ( r, r.programs["updateR"], [
      {name: "r", value: r.textures["A"]},
      {name: "dr", value: r.textures["dr"]},
    ]);

    // Swap the buffers
    var tmp = r.textures["A"];
    r.textures["A"] = r.textures["r"];
    r.textures["r"] = tmp;

    
    // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["r"], 0);
    // render ( r, r.programs["copy"], [
    //   {name: "image", value: r.textures["A"]},
    // ]);
    
    // 7. smooth `r`
    var sigma = 1.0;
    // smoothBuffer ( r, "r", 8.0 );
  }  
}

function smoothBuffer ( r, buffer, sigma ) {
  // First do horizontal pass from buffer into "B"
  // Second do vertical pass from "B" into buffer
  var gl = r.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["B"], 0);
  render ( r, r.programs["smooth"], [
    {name: "image", value: r.textures[buffer]},
    {name: "delta", value: 1/512},
    {name: "sigma", value: sigma},
    {name: "direction", value: 0},
  ]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures[buffer], 0);
  render ( r, r.programs["smooth"], [
    {name: "image", value: r.textures["B"]},
    {name: "delta", value: 1/512},
    {name: "sigma", value: sigma},
    {name: "direction", value: 1},
  ]);
}
