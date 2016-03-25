# registerGL

2d image registration using WebGL.

## Algorithm

1. Create a floating point RGB texture buffer
2. render a difference image into the buffer
3. use a shaders to progressively sum using a pyramid
4. use [Adaptive Stochastic Gradient Descent Optimisation](http://link.springer.com/article/10.1007/s11263-008-0168-y) to fit

### Image differences by rendering to texture

# Build

```bash
gulp  # open http://localhost:3000
```

# Libraries

jQuery

[es6-promise](https://github.com/stefanpenner/es6-promise)