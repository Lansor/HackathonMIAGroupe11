from PIL import Image
import pytesseract
from pdf2image import convert_from_path

def ocr_from_pdf(pdf_path):
    images = convert_from_path(pdf_path)
    text = ""
    for img in images:
        text += pytesseract.image_to_string(img, lang="fra") + "\n"
    return text

def ocr_from_image(image_path):
    img = Image.open(image_path)
    text = pytesseract.image_to_string(img, lang="fra")
    return text