// public/sw.js

self.addEventListener("push", function (event) {
    if (event.data) {
      const data = event.data.json();
      
      const options = {
        body: data.body,
        icon: "/icon-192x192.png", // PWA 세팅할 때 쓰신 아이콘 경로로 맞춰주세요
        badge: "/icon-192x192.png",
        vibrate: [200, 100, 200], // 알림 올 때 진동 패턴
        data: {
          url: data.url || "/", // 알림 클릭 시 이동할 주소
        },
      };
  
      event.waitUntil(
        self.registration.showNotification(data.title, options)
      );
    }
  });
  
  // 알림을 클릭했을 때의 동작
  self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  });
  