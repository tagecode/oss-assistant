import type { AppSettings } from '../../../shared/types/storage'

/**
 * 解析本次下载的落地目录。
 *
 * 这里用 `||` 而不是 `??` 折叠空值：设置里的「默认下载路径」是自由文本输入，
 * 用户清空后会持久化成空串，`??` 会把空串当成有效值保留下来，最终让
 * `resolveDownloadPath` 拼出相对路径写入进程工作目录。
 *
 * @returns 目录路径。返回空串表示没有可用目录，调用方应改为让用户选择目录。
 */
export function resolveDownloadDir(
  settings: Pick<AppSettings, 'lastDownloadPath' | 'defaultDownloadPath'>
): string {
  return settings.lastDownloadPath || settings.defaultDownloadPath || ''
}
