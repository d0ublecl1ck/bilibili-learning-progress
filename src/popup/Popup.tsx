import './Popup.css'

export const Popup = () => {
  const openDashboard = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options.html'),
    })
  }

  return (
    <main className="popup">
      <h1>学习进度</h1>
      <button className="open-button" onClick={openDashboard}>
        打开进度页面
      </button>
    </main>
  )
}

export default Popup
