
/**
 * Utility functions for DOCX document processing
 */
import JSZip from "jszip";
import FileSaver from "file-saver";
import { insertImageIntoDocx } from "./imageUtils";

/**
 * Processes a DOCX template file by replacing placeholders with data
 * @param {File} file - The DOCX template file
 * @param {Object} data - The data to insert into the template
 * @param {Function} progressCallback - Callback for progress updates
 * @returns {Promise<void>} Promise that resolves when processing is complete
 */
export const processDocxTemplate = async (file, data, progressCallback) => {
  if (!progressCallback) {
    progressCallback = () => {};
  }

  // Load the docx file as a zip
  const zip = await JSZip.loadAsync(file);
  progressCallback(20);

  // Get document.xml content
  let documentXml = await zip.file("word/document.xml")?.async("string");
  let relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
  console.log("Original XML:", documentXml?.substring(0, 500) + "...");
  progressCallback(30);

  // Simple string replacement approach - more reliable for basic templates
  let modifiedXml = documentXml;
  let mediaFiles = [];

  // Replace all placeholders in the XML string
  Object.entries(data).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    const regex = new RegExp(placeholder, "g");

    if (typeof value === "string") {
      if (value.startsWith("data:image")) {
        // Handle image placeholders
        const result = insertImageIntoDocx(
          modifiedXml,
          relsXml,
          placeholder,
          value,
          112
        );

        modifiedXml = result.modifiedXml;
        relsXml = result.newRelsXml;
        mediaFiles.push(result.media);
        console.log(`Processed image placeholder: ${placeholder}`);
      } else {
        // Simple text replacement
        modifiedXml = modifiedXml.replace(regex, value);
      }
    } else {
      // Handle other data types
      modifiedXml = modifiedXml.replace(regex, String(value));
    }
  });

  // Update XML in zip
  zip.file("word/document.xml", modifiedXml);
  zip.file("word/_rels/document.xml.rels", relsXml);
  
  // Add all media files to the zip
  mediaFiles.forEach(media => {
    zip.file(`word/media/${media.filename}`, media.buffer);
  });

  progressCallback(80);

  // Generate new docx
  const outputZip = await zip.generateAsync({ type: "blob" });
  FileSaver.saveAs(outputZip, `Generated-${file.name}`);

  progressCallback(90);
};