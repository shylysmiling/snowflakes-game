function ImageVariants(width, height, altColor, urls) {
	var variantIndex = 0

	this.altColor = altColor

	var image = new Image(width, height)
	image.src = urls[variantIndex]

	image.onload = () => {
		this.image = image
	}

	image.onerror = () => {
		if(variantIndex < urls.length) {
			image.src = urls[++variantIndex]
		}
	}
}

ImageVariants.prototype = {
	draw(context, x, y, width, height) {
    if(this.image) {
			context.drawImage(this.image, x, y, width, height)
		} else {
			context.fillStyle = this.altColor
			context.fillRect(x, y, width, height)
		}
	},
}

function getMaxScore() {
	return (window.localStorage && window.localStorage.maxScore) || 500
}

function setMaxScore(value) {
	if(window.localStorage) {
		window.localStorage.maxScore = value
	}
}

var canvas = document.querySelector(`canvas#game`)
var context = canvas.getContext(`2d`)
var pixelRatio = window.devicePixelRatio || 1

var imageVariants = new ImageVariants(100, 100, `#000`, [
	...((new Date().getMonth() == 5) ? [`https://raw.githubusercontent.com/NixOS/nixos-artwork/refs/heads/master/logo/nix-snowflake-rainbow.svg`] : []),
	`https://raw.githubusercontent.com/NixOS/nixos-artwork/refs/heads/master/logo/nix-snowflake-colours.svg`,
	`https://upload.wikimedia.org/wikipedia/commons/2/28/Nix_snowflake.svg`,
	`./generic_snowflake.svg`,
])

var minScore = -100
var maxScore = getMaxScore()
var minSnowflakeSize = 15
var maxSnowflakeSize = minSnowflakeSize + 40
var speed = 1

var snowflakes = []
var timeElapsed = 0
var totalScore = 0
var isGameOver = false
var isWin = false
var intervalMs = 1000/60
var eatStreak = 1

function resizeCanvasToViewport() {
	canvas.width  = window.innerWidth
	canvas.height = window.innerHeight
}

window.onresize = resizeCanvasToViewport
resizeCanvasToViewport()

function createSnowflake() {
  var k = Math.random()
  var height = ((maxSnowflakeSize - minSnowflakeSize) * k + minSnowflakeSize)

  return {
    image: imageVariants,
    width: height,
    height: height,
    x: 0.5 * k * canvas.width,
    y: -height,
    originX: 0.5 * height,
    originY: 0.5 * height,
    rotation: 0,

    draw() {
			var previousTransform = context.getTransform()

			context.scale(1 / pixelRatio, 1 / pixelRatio)
			context.translate(this.x, this.y)
			context.rotate(this.rotation)
			context.translate(-this.originX, -this.originY)

			this.image.draw(context, 0, 0, this.width, this.height)

			context.setTransform(previousTransform)
    },

    isFallen() {
      return (this.y - this.height) >= canvas.height * pixelRatio ||
             (this.x - this.width)  >= canvas.width  * pixelRatio ||
             (this.x - this.width)  <  0
    },

    update() {
			var f = (0.001 * timeElapsed * k)
			var p = (200 * k)

			this.x += Math.max(0, Math.cos(f + p) + 0.72)
			this.y += Math.max(0, Math.sin(f + p) + 1.5)

			this.rotation = 0.03 * Math.cos(f + p)
    },

    containsPoint(x, y) {
      return (this.x <= (pixelRatio * x + this.originX) && (pixelRatio * x + this.originX) < (this.x + this.width)) &&
             (this.y <= (pixelRatio * y + this.originY) && (pixelRatio * y + this.originY) < (this.y + this.height))
    },
  }
}

function isTimeToSpawn() {
	var score = Math.max(Math.E, Math.abs(totalScore) / maxScore * 1000)
  return (Math.random() / Math.log(score)) < 0.015
}

function tapCanvas(event) {
  var index = snowflakes.findIndex(x => x.containsPoint(event.offsetX, event.offsetY))

	if(index >= 0) {
		var snowflake = snowflakes[index]
		snowflakes = snowflakes.filter((_, i) => i != index)
		eatStreak += 1
		addScore(1 + 5 * (1 - snowflake.width / maxSnowflakeSize) * eatStreak)
	} else {
		eatStreak = 0
	}
}

canvas.onclick = tapCanvas

function addScore(value) {
	totalScore += value

  if(!(minScore <= totalScore && totalScore <= maxScore)) {
  	isWin = (totalScore >= 0)
  	isGameOver = true
  }
}

function drawCenteredText(x, y, text, font, style) {
  context.font = font
  context.fillStyle = style

  var textMetrics = context.measureText(text)
  context.fillText(text, x - 0.5 * textMetrics.width, y - 0.5 * textMetrics.emHeightDescent)
}

function snowflakesScreen() {
	var time = Date.now()

  timeAccum += (time - previousTime) * speed
  previousTime = time

  while(timeAccum - intervalMs >= 0) {
    snowflakes = snowflakes.filter(x => {
      if(x.isFallen()) {
        addScore(-(2 + 3 * (1 - x.width / maxSnowflakeSize)) * Math.log(Math.abs(totalScore) / 5 + 2.9))
        return false
      }

      return true
    })

    snowflakes.forEach(x => x.update())

    if(isTimeToSpawn()) {
      snowflakes.push(createSnowflake())
    }

    timeElapsed += intervalMs
    timeAccum -= intervalMs
  }

  context.clearRect(0, 0, canvas.width, canvas.height)

	context.fillStyle = `#ddd`
	context.fillRect(0, 0, canvas.width * (totalScore / maxScore), 20)

  if(totalScore != 0) {
    drawCenteredText(0.5 * canvas.width, 0.5 * canvas.height, `${Math.trunc(totalScore)}`, `48pt sans`, `#888`)
  }

	if(eatStreak > 1) {
    drawCenteredText(0.5 * canvas.width, 0.5 * canvas.height + 50, `x${Math.trunc(eatStreak)}`, `24pt sans`, `#666`)
	}

  snowflakes.forEach(x => x.draw())

	if(isGameOver) {
  	setTimeout(() => requestAnimationFrame(gameOverScreen), intervalMs)
  } else {
    setTimeout(() => requestAnimationFrame(snowflakesScreen), intervalMs)
  }
}

function gameOverScreen() {
	var caption = isWin ? `you win.` : `you lose.`
	var x = 0.5 * canvas.width
  var y = 0.5 * canvas.height

	context.fillStyle = `#fff`
	context.fillRect(0, 0, canvas.width, canvas.height)

  drawCenteredText(x + 15, y, caption, `36pt sans-serif`, `#777`)

	if(isWin) {
		setMaxScore(maxScore * 1.3)

    if(totalScore != 0) {
      drawCenteredText(x, y + 60, `x${Math.trunc(eatStreak)}`, `24pt sans-serif`, `#777`)
    }

    drawCenteredText(x, y + 120, `enjoy your prize.`, `24pt sans-serif`, `#777`)
    setTimeout(() => {
      window.location = `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
    }, 3500)
  } else {
  	drawCenteredText(x, y + 50, `and now required to install`, `24pt sans-serif`, `#777`)
    drawCenteredText(x - 40, y + 140, `NixOS`, `48pt sans-serif`, `#666`)
		imageVariants.draw(context, x + 65, y + 40, 100, 100)
    setTimeout(() => {
      drawCenteredText(x - 140, y + 230, `starting in...`, `30pt sans-serif`, `#777`)
      setTimeout(() => {
        drawCenteredText(x - 0, y + 280, `1...`, `30pt sans-serif`, `#777`)
        setTimeout(() => {
          drawCenteredText(x + 40, y + 330, `2...`, `30pt sans-serif`, `#777`)
          setTimeout(() => {
            drawCenteredText(x + 90, y + 380, `3...`, `30pt sans-serif`, `#777`)
            setTimeout(() => {
              window.location = `https://nixos.org/download/#download-nix`
            }, 500)
          }, 1000)
        }, 1000)
      }, 1000)
		}, 2000)
  }
}

var previousTime = Date.now()
var timeAccum = 0

requestAnimationFrame(snowflakesScreen)
