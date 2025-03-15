/**
 * Utility functions for handling image operations in DOCX files
 */

/**
 * Inserts an image into a DOCX document by replacing a placeholder
 * @param {string} documentXml - The document XML content
 * @param {string} relsXml - The relationships XML content
 * @param {string} placeholder - The placeholder to replace with an image
 * @param {string} imageData - The image data (base64 string)
 * @param {number} width - The width of the image in pixels
 * @returns {Object} The modified XML and media data
 */
export const insertImageIntoDocx = (documentXml, relsXml, placeholder, imageData, width = 100) => {
    // Extract the base64 data from the data URL
    const base64Data = imageData.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Generate a unique but consistent filename and ID for the image
    // Using a stable ID pattern helps avoid document corruption
    const imageId = `rId${Math.floor(Math.random() * 1000) + 1000}`; // More stable ID format
    const imageFilename = `image${imageId.substring(3)}.png`;
    
    // Create the relationship entry for the image
    // Make sure we're not breaking the XML structure
    let newRelsXml = relsXml;
    
    // Check if the Relationships closing tag exists and insert before it
    if (newRelsXml.includes('</Relationships>')) {
      const relationshipXml = `<Relationship Id="${imageId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imageFilename}"/>`;
      newRelsXml = newRelsXml.replace('</Relationships>', `${relationshipXml}</Relationships>`);
    } else {
      // If no closing tag, something is wrong with the relationships file
      throw new Error("Invalid relationships XML structure");
    }
    
    // Create the drawing XML for the image - simplified and with proper XML namespace declarations
    const drawingXml = `
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
            <wp:extent cx="${width * 9525}" cy="${width * 9525}"/>
            <wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="1" name="Picture"/>
            <wp:cNvGraphicFramePr>
              <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
            </wp:cNvGraphicFramePr>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="1" name="Picture"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="${imageId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                    <a:stretch>
                      <a:fillRect/>
                    </a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm>
                      <a:off x="0" y="0"/>
                      <a:ext cx="${width * 9525}" cy="${width * 9525}"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect">
                      <a:avLst/>
                    </a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    `;
  
    // Find and replace the placeholder in the document XML
    // Looking specifically for run elements containing our placeholder
    const placeholderPattern = new RegExp(`<w:r[^>]*>.*?<w:t[^>]*>[^<]*${placeholder}[^<]*</w:t>.*?</w:r>`, 'gs');
    
    // Replace the entire run containing the placeholder
    const modifiedXml = documentXml.replace(placeholderPattern, drawingXml);
  
    return {
      modifiedXml,
      newRelsXml,
      media: {
        filename: imageFilename,
        buffer: imageBuffer
      }
    };
  };