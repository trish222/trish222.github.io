import assert from 'node:assert/strict';
import { quadTransform } from '../src/overlay/projection.js';

// Projective mapping must hit all four corners, including a skewed quad.
for (const quad of [ [[10,20],[110,20],[110,100],[10,100]], [[10,20],[120,30],[100,140],[0,100]] ]) {
  const transform = quadTransform(quad, 900, 600);
  const values = transform.slice(transform.indexOf('(') + 1, -1).split(',').map(Number);
  for (const [i, [x,y]] of [[0,[0,0]], [1,[900,0]], [2,[900,600]], [3,[0,600]]]) {
    let result;
    if (values.length === 6) {
      const [a,c,b,d,e,f] = values;
      result = [a*x+b*y+e, c*x+d*y+f];
    } else {
      const w = values[3]*x + values[7]*y + values[15];
      result = [(values[0]*x+values[4]*y+values[12])/w, (values[1]*x+values[5]*y+values[13])/w];
    }
    assert.ok(result.every((value,j) => Math.abs(value-quad[i][j]) < 1e-8));
  }
}
console.log('PASS affine and perspective screen registration');
