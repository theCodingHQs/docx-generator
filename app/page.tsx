"use client";

import { useState } from "react";
import FixedDocxProcessor from "../docx-processor";

export default function SyntheticV0PageForDeployment() {
  const initialData = {
    txt__first_name: "John",
    txt__last_name: "Doe",
    txt__email: "john.doe@example.com",
    txt__phone: "123-456-7890",
    txt__address: "123 Main St, Anytown, USA",
    txt__city: "Anytown",
    txt__state: "CA",
    txt__zip: "12345",
    txt__country: "USA",
    img_url__image_1:
      "https://s3.ap-south-1.amazonaws.com/valuation.production/dtf6y6zh0skk6w4r85uh8mg5kquq",
    img_url__image_2:
      "https://s3.ap-south-1.amazonaws.com/valuation.production/eumvfn1nnnsu1sri0d7chweqiflg",
  };
  const [data, setData] = useState(initialData);

  const onFinalizeData = (e: React.FormEvent) => {
    e.preventDefault();
    const newData = JSON.parse(e.currentTarget[0].value);
    console.log(newData)
    setData(newData);
  }

  return <div style={{}}>
    <form onSubmit={onFinalizeData} style={{width: "100%",  display: "flex", flexDirection: "column", gap: "20px" , alignItems: "center", justifyContent: "center"}}>
    <textarea
  defaultValue={JSON.stringify(data, null, 2)}
  rows={20}
  style={{
    width: "80%",
    maxWidth: "100%",
    border: "1px solid #ccc",
    padding: "10px",
    margin: '20px',
    whiteSpace: 'pre',
    fontFamily: 'monospace',
    overflow: 'auto'
  }}
/>
    <button type="submit" style={{ width: "fit-content",borderRadius:'5px',  border: "1px solid #ccc", padding: "10px", margin:'20px' }}>Finalize data</button>
    </form>
    <div style={{width: "100%",  display: "flex", flexDirection: "column", gap: "20px" , alignItems: "center", justifyContent: "center"}}>After data Finalization ⬇️</div>
    <FixedDocxProcessor data={data} />
  </div>;
}
