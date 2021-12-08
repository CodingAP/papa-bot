const robot = require('robotjs');
const fs = require('fs');

class Utils {
    static toGrayscale(...args) {
        if (args.length == 1) {
            if (args[0] == null) return null;
            return Math.floor((args[0].r + args[0].g + args[0].b) / 3);
        } else {
            return Math.floor((args[0] + args[1] + args[2]) / 3);
        }
    }

    static getPixelColor(bitmap, x, y) {
        return bitmap.data[(y * bitmap.width) + x];
    }

    static getAverageColor(bitmap, mask = null) {
        if (mask && bitmap.width != mask.width && bitmap.height != mask.height) return null;
        let average = { r: 0, g: 0, b: 0 };
        let size = 0;

        for (let y = 0; y < bitmap.height; y++) {
            for (let x = 0; x < bitmap.width; x++) {
                let color = Utils.getPixelColor(bitmap, x, y);
                if (mask && Utils.getPixelColor(mask, x, y).a == 0) continue;

                average.r += color.r;
                average.g += color.g;
                average.b += color.b;
                size++;
            }
        }

        if (size == 0) return null;
        return { r: Math.round(average.r / size), g: Math.round(average.g / size), b: Math.round(average.b / size), a: 255 };
    }

    static differentiator(bitmap, image) {
        if (bitmap.width != image.width || bitmap.height != image.height) return null;
        let diff = { r: 0, g: 0, b: 0 }, size = 0;

        for (let y = 0; y < bitmap.height; y++) {
            for (let x = 0; x < bitmap.width; x++) {
                let index = (y * bitmap.width) + x;

                if (image.data[index].a == 0) continue;

                diff.r += Math.abs(bitmap.data[index].r - image.data[index].r);
                diff.g += Math.abs(bitmap.data[index].g - image.data[index].g);
                diff.b += Math.abs(bitmap.data[index].b - image.data[index].b);
                size++;
            }
        }

        return { r: diff.r / size, g: diff.g / size, b: diff.b / size };
    }

    static getSubBitmap(bitmap, region) {
        let data = [];
        for (let y = 0; y < region.height; y++) {
            for (let x = 0; x < region.width; x++) {
                data[y * region.width + x] = bitmap.data[((y + region.y) * bitmap.width) + (x + region.x)];
            }
        }

        return {
            width: region.width,
            height: region.height,
            data: data
        }
    }

    static getScreenBitmap(region) {
        let image = (region) ? robot.screen.capture(region.x, region.y, region.width, region.height) : robot.screen.capture();
        let bitmap = {};
        bitmap.width = image.width;
        bitmap.height = image.height;
        bitmap.data = [];

        for (let y = 0; y < image.height; y++) {
            for (let x = 0; x < image.width; x++) {
                let bitmapIndex = (y * image.width) + x;
                let imageIndex = 4 * bitmapIndex;

                bitmap.data[bitmapIndex] = { r: image.image[imageIndex + 2], g: image.image[imageIndex + 1], b: image.image[imageIndex + 0], a: image.image[imageIndex + 3] };
            }
        }

        return bitmap;
    }
}

let data = JSON.parse(fs.readFileSync('./src/data.json').toString());

let dragIngredients = (ingredient, coordinate) => {
    // Parse coordinate ex. quad1-3
    let [quad, amount] = coordinate.split('-');

    // Move mouse to correct positions
    let points = data.pizzaPoints[quad][parseInt(amount) - 1];
    for (let i = 0; i < points.length; i++) {
        robot.moveMouse(data.topLeft.x + data.ingredientTubs[ingredient].x, data.topLeft.y + data.ingredientTubs[ingredient].y);
        robot.mouseToggle('down');
        robot.moveMouse(data.topLeftPizza.x + points[i].x, data.topLeftPizza.y + points[i].y);
        robot.mouseToggle('up');
    }
}

let analyzeOrder = () => {
    let screen = Utils.getScreenBitmap({
        x: data.topLeft.x,
        y: data.topLeft.y,
        width: data.windowSize.width,
        height: data.windowSize.height
    });

    let order = {
        ingredients: [],
        cookTime: 0,
        cut: 0
    };

    let index = 0;
    while (true) {
        let quadrantBitmap = Utils.getSubBitmap(screen, {
            x: data.ticketQuadrantBase.x,
            y: data.ticketQuadrantBase.y,
            width: data.ticketQuadrantSize.width,
            height: data.ticketQuadrantSize.height + (data.ticketQuadrantOffset * index)
        });

        if (Utils.toGrayscale(Utils.getAverageColor(quadrantBitmap)) >= 190) break;

        let quadrants = [];
        let quadrant1Bitmap = Utils.getSubBitmap(quadrantBitmap, { x: 0, y: 0, width: 12, height: 12 }); quadrants.push(Utils.toGrayscale(Utils.getAverageColor(quadrant1Bitmap)) < 175);
        let quadrant2Bitmap = Utils.getSubBitmap(quadrantBitmap, { x: 11, y: 0, width: 12, height: 12 }); quadrants.push(Utils.toGrayscale(Utils.getAverageColor(quadrant2Bitmap)) < 175);
        let quadrant3Bitmap = Utils.getSubBitmap(quadrantBitmap, { x: 0, y: 11, width: 12, height: 12 }); quadrants.push(Utils.toGrayscale(Utils.getAverageColor(quadrant3Bitmap)) < 175);
        let quadrant4Bitmap = Utils.getSubBitmap(quadrantBitmap, { x: 11, y: 11, width: 12, height: 12 }); quadrants.push(Utils.toGrayscale(Utils.getAverageColor(quadrant4Bitmap)) < 175);

        console.log(quadrants);
        index++;
    }

    return order;
}

let makePizza = order => {
    for (let i = 0; i < order.ingredients.length; i++) {
        let numOfQuads = order.ingredients[i].quadrants.filter(element => element).length;
        let ingredientsPerSlice = order.ingredients[i].amount / numOfQuads;
        for (let j = 0; j < order.ingredients[i].quadrants.length; j++) {
            if (order.ingredients[i].quadrants[j]) dragIngredients(order.ingredients[i].type, `quad${j + 1}-${ingredientsPerSlice}`);
        }
    }
}

makePizza({
    ingredients: [
        {
            type: "pepperoni",
            amount: 24,
            quadrants: [true, true, true, true]
        },
        {
            type: "sasuage",
            amount: 24,
            quadrants: [true, true, true, true]
        },
        {
            type: "mushroom",
            amount: 24,
            quadrants: [true, true, true, true]
        },
        {
            type: "pepper",
            amount: 24,
            quadrants: [true, true, true, true]
        },
        {
            type: "onion",
            amount: 24,
            quadrants: [true, true, true, true]
        },
        {
            type: "olive",
            amount: 24,
            quadrants: [true, true, true, true]
        },
        {
            type: "sardine",
            amount: 24,
            quadrants: [true, true, true, true]
        }
    ]
});
// analyzeOrder();