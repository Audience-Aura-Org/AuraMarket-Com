import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./api', () => ({ default: { post: vi.fn() } }));
vi.mock('axios', () => ({ default: { put: vi.fn() } }));
import api from './api';
import axios from 'axios';
import { uploadService } from './upload';
beforeEach(() => vi.resetAllMocks());
describe('story upload boundaries', () => {
  it('rejects oversized stories before making requests', async () => {
    await expect(uploadService.uploadSingle({ type:'video/mp4', size:17*1024*1024 }, 'statuses')).rejects.toThrow('File is too large');
    expect(api.post).not.toHaveBeenCalled();
  });
  it('uploads a video directly and returns its durable URL', async () => {
    api.post.mockResolvedValue({data:{success:true,data:{uploadUrl:'https://upload.test/file',url:'https://media.test/story.mp4'}}});
    axios.put.mockResolvedValue({});
    const result=await uploadService.uploadSingle(new File(['clip'],'clip.mp4',{type:'video/mp4'}),'statuses');
    expect(result.data.url).toBe('https://media.test/story.mp4'); expect(axios.put).toHaveBeenCalledOnce();
  });
  it('does not publish an incomplete API upload response', async () => {
    api.post.mockResolvedValueOnce({data:{success:false}}).mockResolvedValueOnce({data:{success:true,data:{}}});
    await expect(uploadService.uploadSingle(new File(['clip'],'clip.mp4',{type:'video/mp4'}),'statuses')).rejects.toThrow('Upload did not return a media URL');
  });
});
