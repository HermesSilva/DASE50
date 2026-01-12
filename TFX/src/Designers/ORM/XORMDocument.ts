import { XDocument } from "../../Design/XDocument.js";
import { XORMDesign } from "./XORMDesign.js";

export class XORMDocument extends XDocument<XORMDesign>
{
    public constructor()
    {
        super();
        this.PDesign = new XORMDesign();
        this.AppendChild(this.PDesign);
    }

    public override Initialize(): void
    {
        super.Initialize();
        
        // After deserialization, there may be multiple XORMDesign children:
        // 1. The auto-created empty one from the constructor
        // 2. The deserialized one(s) with actual content
        // We need to consolidate them into a single design
        
        const allDesigns = this.ChildNodes.filter(
            child => child instanceof XORMDesign
        ) as XORMDesign[];
        
        console.log(`[XORMDocument.Initialize] Found ${allDesigns.length} XORMDesign instances`);
        
        if (allDesigns.length > 1)
        {
            // Strategy: Keep the first design with content, merge others into it, then remove duplicates
            let primaryDesign = allDesigns[0];
            
            // If first is empty but others have content, use the first non-empty one
            if (primaryDesign.ChildNodes.length === 0)
            {
                const nonEmpty = allDesigns.find(d => d.ChildNodes.length > 0);
                if (nonEmpty)
                    primaryDesign = nonEmpty;
            }
            
            console.log(`[XORMDocument.Initialize] Using design with ${primaryDesign.ChildNodes.length} children as primary`);
            
            // Merge all tables and references from other designs into the primary
            for (const design of allDesigns)
            {
                if (design !== primaryDesign && design.ChildNodes.length > 0)
                {
                    console.log(`[XORMDocument.Initialize] Merging design with ${design.ChildNodes.length} children`);
                    
                    // Move all children from this design to primary
                    const children = [...design.ChildNodes];
                    for (const child of children)
                    {
                        design.RemoveChild(child);
                        primaryDesign.AppendChild(child);
                    }
                }
            }
            
            // Remove all designs except the primary
            for (const design of allDesigns)
            {
                if (design !== primaryDesign)
                {
                    const idx = this.ChildNodes.indexOf(design);
                    console.log(`[XORMDocument.Initialize] Removing duplicate design at index ${idx}`);
                    this.ChildNodes.splice(idx, 1);
                }
            }
            
            this.PDesign = primaryDesign;
            console.log(`[XORMDocument.Initialize] Final design has ${this.PDesign.ChildNodes.length} children`);
        }
        else if (allDesigns.length === 1)
        {
            this.PDesign = allDesigns[0];
            console.log(`[XORMDocument.Initialize] Single design with ${this.PDesign.ChildNodes.length} children`);
        }
    }
}