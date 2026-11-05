"""Offline framing sanity checks using measured bounds from the supplied GLB.
These do not replace a live browser screenshot or WebGL test.
"""
from math import tan, radians
SCALE=.53
HIP=(.15,-.34,-.92)
ADS=(0.,-.457*SCALE,-.93)
SOURCE_ARM_REAR_Z=-1.30472
SOURCE_SCOPE_Y=(.429+.489)/2
SOURCE_SCOPE_X=(-.03+.03)/2
NEAR=.04
# 180 degree yaw converts source -Z arms to +Z camera space.
arm_rear_camera_z=HIP[2]-SCALE*SOURCE_ARM_REAR_Z
assert arm_rear_camera_z<-NEAR, f'Arms near-clipping: {arm_rear_camera_z}'
sight_x=ADS[0]-SCALE*SOURCE_SCOPE_X
sight_y=ADS[1]+SCALE*SOURCE_SCOPE_Y
assert abs(sight_x)<.02 and abs(sight_y)<.02, f'Sight not centred: {sight_x},{sight_y}'
# The base weapon model is 36% bigger than the previous .39-scaled view.
assert SCALE/.39 > 1.3
print('PASS: arm geometry clears camera near plane, ADS optic centres, base weapon visually larger')
