const API_URL = process.env.API_URL || "http://127.0.0.1:8000";

export async function Upload_Pdf(file: File) {
  const formdata = new FormData();

  formdata.append("file", file);

  // console.log("api url :: ", API_URL)
  // print("api url is :: ", API_URL);
  const response = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formdata,
  });

  if (!response.ok) {
    throw new Error("failed to upload pdf ");
  }

  return response.json();
}

export async function Ask_Question(question: string) {
  const formdata = new FormData();

  formdata.append("question", question);

  const response = await fetch(`${API_URL}/ask`, {
    method: "POST",
    body: formdata,
  });

  if (!response.ok) {
    throw new Error("failed to ask question try again .! ");
  }

  return response.json();
}
