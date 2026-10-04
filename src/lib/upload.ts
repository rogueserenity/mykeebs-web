export async function uploadToSignedUrl(uploadUrl: string, file: File): Promise<void> {
	const put = await fetch(uploadUrl, {
		method: 'PUT',
		headers: { 'Content-Type': file.type },
		body: file
	});
	if (!put.ok) throw new Error(`upload failed: ${put.status}`);
}
