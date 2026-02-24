

// Upload image buffer to imgbb; returns { url, deleteUrl }
export const uploadToImgbb = async (buffer, filename) => {
    const base64 = buffer.toString("base64");

    const form = new FormData();
    form.append("image", base64);
    form.append("name", filename);

    const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY_V1}`,
        { method: "POST", body: form }
    );

    const data = await response.json();

    if (!data.success) throw new Error(`imgbb upload failed: ${JSON.stringify(data)}`);

    return {
        url: data.data.display_url,
        deleteUrl: data.data.delete_url,
    };
};

// Delete image from imgbb using the stored delete URL
export const deleteFromImgbb = async (deleteUrl) => {
    try {
        await fetch(deleteUrl);
    } catch (err) {
        console.error("imgbb delete failed:", err.message);
    }
};