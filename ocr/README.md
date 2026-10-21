# Photo reader models

Plotline reads text from photos with PaddleOCR's PP-OCRv6 small models, run in the browser with ONNX Runtime Web (see `paddleRead` in `ink.js`).

- `det.onnx` finds the lines of text. It is `PP-OCRv6_det_small.onnx` from the rapidocr 3.10.0 package, unchanged.
- `rec.onnx` reads each line. It is `PP-OCRv6_rec_small.onnx` with the output layer cut down to Latin, Greek and Cyrillic letters, digits and common symbols: 635 classes instead of 18,710.
- `rec_chars.json` is the character list for `rec.onnx`, in output order. Index 0 of the output is the CTC blank, and the last entry is a space.

The models are Apache-2.0 licensed (PaddlePaddle/PaddleOCR, packaged by RapidAI/RapidOCR). The app keeps them in its own cache (`plotline-ocr-v1`), so they download once. The Android app fetches them from the GitHub Pages copy of this folder.
