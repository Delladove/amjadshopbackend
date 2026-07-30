# AMJC Wholesale

A wholesale/retail management app for Amjad Magic Center — bills (walk-in &
booking), product catalog with barcodes, a customer-facing storefront, and a
tablet-friendly warehouse packing screen. Rebuilt as a real client/server app
(previously a single self-contained HTML file) so multiple devices — an
admin's phone, a wall-mounted warehouse tablet, a customer kiosk — can share
the same live data.

# Mondodb Atlas and Azure blob storage

Images are resized to 800px and converted to Webp before uploading to Azure storage.
public url is saved in mongodb atlas. 
This repo is created to deploy it to vercel.