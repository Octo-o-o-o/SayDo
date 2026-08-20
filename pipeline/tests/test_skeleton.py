"""0.1 骨架测试:包可导入、版本存在(真实管线测试随 1.1/1.2)。"""

import saydo_pipeline


def test_import() -> None:
    assert saydo_pipeline.__version__
